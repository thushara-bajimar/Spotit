import { HeroSection } from '../../components/landing/HeroSection.jsx';
import { CategoriesSection } from '../../components/landing/CategoriesSection.jsx';
import { HowItWorksSection } from '../../components/landing/HowItWorksSection.jsx';
import { AudienceCtaSection } from '../../components/landing/AudienceCtaSection.jsx';

export function LandingPage() {
  return (
    <>
      <HeroSection />
      <CategoriesSection />
      <HowItWorksSection />
      <AudienceCtaSection />
    </>
  );
}
