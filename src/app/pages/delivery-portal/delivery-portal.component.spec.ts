import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Auth } from '@angular/fire/auth';
import { Database } from '@angular/fire/database';
import { DeliveryPortalComponent } from './delivery-portal.component';
import { DeliveryWorkflowService, DeliveryAssignment } from '../../services/delivery-workflow.service';
import { NotificationService } from '../../shared/notification/notification.service';
import { AuthService } from '../../services/auth.service';
import { ThemeService } from '../../services/theme.service';
import { describe, beforeEach, it, expect, vi } from 'vitest';

describe('DeliveryPortalComponent', () => {
  let component: DeliveryPortalComponent;
  let fixture: ComponentFixture<DeliveryPortalComponent>;
  let deliveryServiceMock: {
    watchAgentAssignments: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
    watchHistory: ReturnType<typeof vi.fn>;
  };
  let notificationServiceMock: { show: ReturnType<typeof vi.fn> };
  let authServiceMock: {
    getUserProfile: ReturnType<typeof vi.fn>;
    logout: ReturnType<typeof vi.fn>;
    savePayoutDetails?: ReturnType<typeof vi.fn>;
    submitPayoutRequest?: ReturnType<typeof vi.fn>;
  };

  const sampleAssignments: DeliveryAssignment[] = [
    {
      orderId: 'order-1',
      uid: 'student-1',
      agentUid: 'agent-1',
      status: 'assigned',
      assignedAt: '2026-10-28T10:00:00Z',
      assignedBy: 'admin-1',
      studentName: 'Rahul Sharma',
      subject: 'Major Project Report - Hardcover',
      phone: '9876543210',
      address: 'Hostel 3, Room 104',
      pincode: '110025'
    },
    {
      orderId: 'order-2',
      uid: 'student-2',
      agentUid: 'agent-1',
      status: 'in_transit',
      assignedAt: '2026-10-28T11:00:00Z',
      assignedBy: 'admin-1',
      studentName: 'Priya Patel',
      subject: 'Lab Assignment File',
      phone: '9123456789',
      address: 'Sector 62 Campus',
      pincode: '201309'
    },
    {
      orderId: 'order-3',
      uid: 'student-3',
      agentUid: 'agent-1',
      status: 'delivered',
      assignedAt: '2026-10-28T09:00:00Z',
      assignedBy: 'admin-1',
      studentName: 'Ankit Gupta',
      subject: 'IEEE Research Paper',
      phone: '9988776655',
      address: 'Hostel 1, Room 50',
      pincode: '110025'
    }
  ];

  beforeEach(async () => {
    deliveryServiceMock = {
      watchAgentAssignments: vi.fn((_uid, cb) => {
        cb(sampleAssignments);
        return () => {};
      }),
      updateStatus: vi.fn().mockResolvedValue({ id: 'evt-1', status: 'picked_up', note: '', createdAt: new Date().toISOString() }),
      watchHistory: vi.fn(() => () => {})
    };

    notificationServiceMock = { show: vi.fn() };
    authServiceMock = {
      getUserProfile: vi.fn().mockResolvedValue({
        fullName: 'Vikram Singh',
        deliveryID: 'DEL-V123',
        vehicleNumber: 'Bike / DL-01-AB-1234',
        serviceArea: 'North Campus Hub'
      }),
      logout: vi.fn().mockResolvedValue(undefined)
    };

    await TestBed.configureTestingModule({
      imports: [DeliveryPortalComponent],
      providers: [
        provideRouter([]),
        { provide: Auth, useValue: { currentUser: { uid: 'agent-1', email: 'agent@filecrafters.in' } } },
        { provide: Database, useValue: {} },
        { provide: DeliveryWorkflowService, useValue: deliveryServiceMock },
        { provide: NotificationService, useValue: notificationServiceMock },
        { provide: AuthService, useValue: authServiceMock },
        { provide: ThemeService, useValue: { theme: () => 'dark', toggleTheme: vi.fn() } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(DeliveryPortalComponent);
    component = fixture.componentInstance;
    component.assignments = [...sampleAssignments];
    fixture.detectChanges();
  });

  it('creates the delivery portal component', () => {
    expect(component).toBeTruthy();
  });

  it('calculates correct KPI metrics across all assignment statuses', () => {
    expect(component.totalAssigned).toBe(3);
    expect(component.pendingPickupCount).toBe(1);
    expect(component.inTransitCount).toBe(1);
    expect(component.deliveredCount).toBe(1);
  });

  it('filters assignments by status correctly', () => {
    component.setFilter('assigned');
    expect(component.filteredAssignments.length).toBe(1);
    expect(component.filteredAssignments[0].orderId).toBe('order-1');

    component.setFilter('in_transit');
    expect(component.filteredAssignments.length).toBe(1);
    expect(component.filteredAssignments[0].orderId).toBe('order-2');

    component.setFilter('delivered');
    expect(component.filteredAssignments.length).toBe(1);
    expect(component.filteredAssignments[0].orderId).toBe('order-3');

    component.setFilter('all');
    expect(component.filteredAssignments.length).toBe(3);
  });

  it('filters assignments by search query', () => {
    component.searchQuery.set('Priya');
    expect(component.filteredAssignments.length).toBe(1);
    expect(component.filteredAssignments[0].studentName).toBe('Priya Patel');

    component.searchQuery.set('110025');
    expect(component.filteredAssignments.length).toBe(2);

    component.searchQuery.set('nonexistent query');
    expect(component.filteredAssignments.length).toBe(0);
  });

  it('computes next delivery status in delivery sequence', () => {
    expect(component.nextStatus('assigned')).toBe('picked_up');
    expect(component.nextStatus('picked_up')).toBe('in_transit');
    expect(component.nextStatus('in_transit')).toBe('delivered');
    expect(component.nextStatus('delivered')).toBeNull();
  });

  it('formats status labels properly', () => {
    expect(component.statusLabel('assigned')).toBe('Assigned');
    expect(component.statusLabel('in_transit')).toBe('In Transit');
    expect(component.statusLabel('picked_up')).toBe('Picked Up');
    expect(component.statusLabel('failed_delivery')).toBe('Failed Delivery');
  });

  it('generates valid Google Maps and WhatsApp deep links', () => {
    const mapUrl = component.getGoogleMapsUrl('Hostel 3', '110025');
    expect(mapUrl).toContain('google.com/maps');
    expect(mapUrl).toContain('Hostel%203');

    const waUrl = component.getWhatsAppUrl('9876543210', 'Rahul', 'order-123456');
    expect(waUrl).toContain('wa.me/919876543210');
    expect(waUrl).toContain('Rahul');
  });

  it('updates assignment status and notifies driver', async () => {
    const target = component.assignments.find(a => a.orderId === 'order-1')!;
    component.notes[target.orderId] = 'Package picked up from hub';
    await component.update(target);

    expect(deliveryServiceMock.updateStatus).toHaveBeenCalledWith(
      'order-1',
      'picked_up',
      'Package picked up from hub'
    );
    expect(notificationServiceMock.show).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('Picked Up'),
      'Delivery Updated'
    );
  });

  it('calculates driver delivery revenue and available payout balance accurately', () => {
    // 1 delivered order in sampleAssignments at feePerDelivery = 50
    expect(component.deliveredCount).toBe(1);
    expect(component.feePerDelivery).toBe(50);
    expect(component.totalEarnedRevenue).toBe(50);
    expect(component.totalDisbursed).toBe(0);
    expect(component.availableBalance).toBe(50);

    component.setView('revenue');
    expect(component.activeView()).toBe('revenue');
  });

  it('submits a payout request and saves payout account details', async () => {
    component.payoutDetails.method = 'upi';
    component.payoutDetails.upiId = 'courier@okaxis';
    authServiceMock.savePayoutDetails = vi.fn().mockResolvedValue(undefined);
    authServiceMock.submitPayoutRequest = vi.fn().mockResolvedValue({
      id: 'PR-123456',
      amount: 50,
      method: 'upi',
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    await component.savePayoutDetails();
    expect(notificationServiceMock.show).toHaveBeenCalledWith('success', expect.any(String), 'Payout Saved');

    await component.requestPayout(50);
    expect(notificationServiceMock.show).toHaveBeenCalledWith('success', expect.stringContaining('INR 50'), 'Payout Requested');
    expect(component.payoutRequests.length).toBeGreaterThan(0);
  });
});
