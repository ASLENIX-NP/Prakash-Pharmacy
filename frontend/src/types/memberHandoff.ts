/** One-use member-to-workflow handoff. Never treat a shared phone as patient identity. */
export type RegisteredMemberHandoff = {
  id: number;
  name: string;
  phone: string;
  address: string | null;
  membershipNumber: string;
  memberSince: string;
};

export type MemberDestination = 'pos' | 'opd' | 'procedures';

export type MemberHandoff = {
  nonce: string;
  destination: MemberDestination;
  member: RegisteredMemberHandoff;
};
