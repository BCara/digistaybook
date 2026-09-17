import React from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles.css';
import { DashboardOverview } from '../src/ui/host/DashboardOverview';
import { emptyProfile } from '../src/domain/propertyProfile';
const properties = ['Seabreeze Cottage', 'The Old Bakery', 'Harbour House'].map((name, index) => ({id: String(index), name, slug: String(index), ownerUid:'preview', lifecycle: index === 2 ? 'draft' : index === 1 ? 'grace_period' : 'trialing', mode: index === 2 ? 'sandbox' : 'live', foundationalPostCount:0, createdAt:null, updatedAt:null, profile:emptyProfile(), billing:index === 2 ? null : {renewalAmount:1500,renewalCurrency:'aud',renewalInterval:'month',trialEndsAt:'2026-09-14T00:00:00Z',currentPeriodEndsAt:'2026-09-20T00:00:00Z',lastPaymentAt:null}}));
createRoot(document.getElementById('root')!).render(<main className="page"><p className="eyebrow">Host control centre · sample data</p><h1>Your host overview</h1><p className="lede">See your properties, upcoming payments and what needs attention.</p><DashboardOverview properties={properties as any} now={Date.parse('2026-09-11T00:00:00Z')}/><h2>Your properties</h2></main>);
