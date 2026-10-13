/**
 * StateHubs Real Estate Operating System: product capabilities and dependencies.
 * English is the canonical UI language. Capabilities are NOT implementation claims.
 * Modules are composable: an organization can operate in multiple sectors.
 */
export const BUSINESS_MODULES = [
 {key:'brokerage',name:'Brokerage & Sales',description:'Listings, viewings, offers, deal pipeline and commissions',capabilities:['property-listings','buyer-matching','deal-pipeline','viewings','commissions']},
 {key:'residential',name:'Residential Rentals',description:'Tenancies, rent collection, renewals and maintenance',capabilities:['tenancies','rent-ledger','lease-renewals','maintenance']},
 {key:'hospitality',name:'Holiday Rentals',description:'Reservations, guest operations and channel calendars',capabilities:['reservations','occupancy','guest-operations','turnovers','channel-calendars']},
 {key:'investment',name:'Investments & Assets',description:'Acquisitions, portfolios, cash flow and returns',capabilities:['acquisitions','asset-register','portfolio-performance','cash-flow']},
 {key:'development',name:'Development & Buildings',description:'Projects, budgets, buildings and unit sales',capabilities:['development-projects','unit-inventory','project-budgets','unit-sales']},
 {key:'partnerships',name:'Deal Partnerships',description:'Referrals, intermediaries and shared commissions',capabilities:['referrals','deal-partners','commission-splits']},
 {key:'management',name:'Property Management',description:'Service requests, suppliers and remote ownership',capabilities:['work-orders','vendors','inspections','owner-reports']},
 {key:'legal',name:'Legal & Closing',description:'Jurisdiction-aware document preparation and review',capabilities:['jurisdictions','document-templates','closing-checklists','approval-trail']},
 {key:'intelligence',name:'Intelligence Center',description:'Explainable insights and supervised workflows',capabilities:['matching','operations-insights','asset-insights','deal-insights','ai-command-center']},
] as const;

export type BusinessModuleKey = typeof BUSINESS_MODULES[number]['key'];
export type OrganizationRole = 'owner'|'admin'|'agent'|'property_manager'|'investor'|'provider'|'viewer';
export type DealKind = 'sale'|'residential_rental'|'holiday_rental'|'acquisition'|'development'|'referral';
export type ServiceKind = 'keyholding'|'check_in'|'check_out'|'cleaning'|'laundry'|'maintenance'|'emergency'|'inspection'|'concierge'|'full_management';
export type WorkflowStatus = 'draft'|'pending_review'|'approved'|'in_progress'|'completed'|'cancelled';
export type LegalJurisdiction = 'ES'|'AE-DU'|'ID-BA'|'TH'|'PT'|'GB-ENG-WLS'|'US-FL'|'MX'|'GR'|'IT'|'FR'|'JP';

export interface RealEstateOrganization {
 id:string; name:string; country:string; enabledModules:BusinessModuleKey[];
}
export interface PortfolioAsset {
 id:string; organizationId:string; title:string; country:string; jurisdiction:string;
 buildingId?:string; parentAssetId?:string; ownerContactId?:string; address?:string;
 currency:string; acquisitionPrice?:number; status:'prospect'|'active'|'under_contract'|'disposed';
}
export interface RealEstateDeal {
 id:string; organizationId:string; assetId:string; kind:DealKind; stage:string;
 assignedUserId?:string; counterpartyIds:string[]; currency:string;
 price?:number; feeAmount?:number; closingDate?:string;
}
export interface ServiceWorkOrder {
 id:string; organizationId:string; assetId:string; service:ServiceKind;
 providerId?:string; requestedBy:string; priority:'routine'|'high'|'emergency';
 status:WorkflowStatus; dueAt?:string; cost?:number; currency?:string;
 evidenceUrls?:string[]; approvedBy?:string;
}
export interface LegalDocumentCase {
 id:string; organizationId:string; dealId:string; jurisdiction:LegalJurisdiction;
 templateId?:string; templateVersion?:string; status:WorkflowStatus;
 reviewerId?:string; approvalAt?:string; evidenceIds:string[];
}
/** Contract generation requires locally reviewed, versioned templates. */
export const LEGAL_LAUNCH_JURISDICTIONS: ReadonlyArray<{code:LegalJurisdiction;name:string;launchGroup:1|2}> = [
 {code:'ES',name:'Spain',launchGroup:1},{code:'AE-DU',name:'Dubai, United Arab Emirates',launchGroup:1},
 {code:'ID-BA',name:'Bali, Indonesia',launchGroup:1},{code:'TH',name:'Thailand',launchGroup:1},
 {code:'PT',name:'Portugal',launchGroup:2},{code:'GB-ENG-WLS',name:'England and Wales',launchGroup:2},
 {code:'US-FL',name:'Florida, United States',launchGroup:2},{code:'MX',name:'Mexico',launchGroup:2},
 {code:'GR',name:'Greece',launchGroup:2},{code:'IT',name:'Italy',launchGroup:2},
 {code:'FR',name:'France',launchGroup:2},{code:'JP',name:'Japan',launchGroup:2},
];
export function enabledCapabilities(modules:readonly BusinessModuleKey[]):string[] {
 const allowed=new Set(modules);
 return [...new Set(BUSINESS_MODULES.filter(m=>allowed.has(m.key)).flatMap(m=>[...m.capabilities]))];
}
