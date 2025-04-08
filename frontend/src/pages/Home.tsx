import HeroSection from '../components/home/HeroSection.tsx';
import FeaturesSection from '../components/home/FeaturesSection.tsx';
import AppFooter from '../components/layout/AppFooter.tsx'; 

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-base-100">
      <HeroSection />
      <FeaturesSection />
      <AppFooter />
    </div>
  );
}