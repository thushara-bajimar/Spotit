import {
  BedDouble,
  Briefcase,
  Hospital,
  House,
  PartyPopper,
  Shield,
  Sparkles,
  Sprout,
  Store,
  UtensilsCrossed,
} from 'lucide-react';

// Maps the `icon` key stored in job_categories to an icon component.
const ICONS = {
  sparkles: Sparkles,
  bed: BedDouble,
  house: House,
  utensils: UtensilsCrossed,
  sprout: Sprout,
  shield: Shield,
  store: Store,
  party: PartyPopper,
  hospital: Hospital,
  briefcase: Briefcase,
};

export function CategoryIcon({ name, className }) {
  const Icon = ICONS[name] ?? Briefcase;
  return <Icon aria-hidden="true" className={className} />;
}
