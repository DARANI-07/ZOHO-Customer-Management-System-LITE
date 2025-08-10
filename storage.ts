import { type User, type InsertUser, type Contact, type InsertContact, type Activity, type InsertActivity } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Contact methods
  getContacts(filters?: { search?: string; company?: string; status?: string }): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  
  // Activity methods
  getActivities(contactId?: string): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Dashboard metrics
  getMetrics(): Promise<{
    totalContacts: number;
    activeLeads: number;
    todayActivities: number;
    conversionRate: number;
  }>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private contacts: Map<string, Contact>;
  private activities: Map<string, Activity>;

  constructor() {
    this.users = new Map();
    this.contacts = new Map();
    this.activities = new Map();
  }

  // User methods
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Contact methods
  async getContacts(filters?: { search?: string; company?: string; status?: string }): Promise<Contact[]> {
    let contacts = Array.from(this.contacts.values());
    
    if (filters?.search) {
      const searchLower = filters.search.toLowerCase();
      contacts = contacts.filter(contact => 
        contact.name.toLowerCase().includes(searchLower) ||
        contact.email.toLowerCase().includes(searchLower) ||
        (contact.company && contact.company.toLowerCase().includes(searchLower))
      );
    }
    
    if (filters?.company && filters.company !== "all") {
      contacts = contacts.filter(contact => contact.company === filters.company);
    }
    
    if (filters?.status && filters.status !== "all") {
      contacts = contacts.filter(contact => contact.status === filters.status);
    }
    
    return contacts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async createContact(insertContact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const now = new Date();
    const contact: Contact = { 
      ...insertContact,
      title: insertContact.title || null,
      phone: insertContact.phone || null,
      company: insertContact.company || null,
      notes: insertContact.notes || null,
      id, 
      createdAt: now, 
      updatedAt: now 
    };
    this.contacts.set(id, contact);
    return contact;
  }

  async updateContact(id: string, contactUpdate: Partial<InsertContact>): Promise<Contact | undefined> {
    const existing = this.contacts.get(id);
    if (!existing) return undefined;
    
    const updated: Contact = { 
      ...existing, 
      ...contactUpdate, 
      updatedAt: new Date() 
    };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<boolean> {
    const deleted = this.contacts.delete(id);
    // Also delete related activities
    Array.from(this.activities.entries()).forEach(([activityId, activity]) => {
      if (activity.contactId === id) {
        this.activities.delete(activityId);
      }
    });
    return deleted;
  }

  // Activity methods
  async getActivities(contactId?: string): Promise<Activity[]> {
    let activities = Array.from(this.activities.values());
    
    if (contactId) {
      activities = activities.filter(activity => activity.contactId === contactId);
    }
    
    return activities.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const id = randomUUID();
    const activity: Activity = { 
      ...insertActivity,
      description: insertActivity.description || null,
      scheduledAt: insertActivity.scheduledAt || null,
      completedAt: insertActivity.completedAt || null,
      id, 
      createdAt: new Date() 
    };
    this.activities.set(id, activity);
    return activity;
  }

  // Dashboard metrics
  async getMetrics(): Promise<{
    totalContacts: number;
    activeLeads: number;
    todayActivities: number;
    conversionRate: number;
  }> {
    const contacts = Array.from(this.contacts.values());
    const activities = Array.from(this.activities.values());
    
    const totalContacts = contacts.length;
    const activeLeads = contacts.filter(c => c.status === "prospect").length;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const todayActivities = activities.filter(a => {
      const activityDate = new Date(a.createdAt);
      return activityDate >= today && activityDate < tomorrow;
    }).length;
    
    const activeContacts = contacts.filter(c => c.status === "active").length;
    const conversionRate = totalContacts > 0 ? (activeContacts / totalContacts) * 100 : 0;
    
    return {
      totalContacts,
      activeLeads,
      todayActivities,
      conversionRate: Math.round(conversionRate * 10) / 10,
    };
  }
}

export const storage = new MemStorage();
