import Link from "next/link";
import {
  Sparkles,
  Droplet,
  Footprints,
  Utensils,
  HeartPulse,
} from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Top navigation bar */}
      <nav className="flex items-center justify-between px-6 py-6 md:px-12">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-lavender" />
          <span className="text-lavender font-semibold tracking-widest text-sm">
            FITNESS BUDDY
          </span>
        </div>
        <div className="hidden md:flex gap-8 text-lavender/80 text-sm tracking-wide">
          <a href="#about" className="hover:text-lavender transition-colors">
            About
          </a>
          <a href="#features" className="hover:text-lavender transition-colors">
            Features
          </a>
          <a href="#contact" className="hover:text-lavender transition-colors">
            Contact
          </a>
        </div>
      </nav>

      {/* Hero section */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-highlight text-sm md:text-base tracking-[0.4em] font-medium mb-6">
          WELCOME TO
        </p>
        <h1 className="text-white text-5xl md:text-8xl font-bold tracking-tight mb-6">
          FITNESS BUDDY
        </h1>
        <p className="text-lavender/90 text-base md:text-lg max-w-lg mb-10">
          Your personal wellness companion — track it, hack it, own it.
        </p>

        {/* Call-to-action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 mb-16">
          <Link
            href="/signup"
            className="bg-primary hover:bg-highlight text-white font-semibold tracking-widest px-8 py-4 rounded-full transition-colors shadow-[0_0_30px_rgba(157,78,221,0.5)]"
          >
            SIGN UP FREE
          </Link>
          <Link
            href="/login"
            className="border-2 border-primary text-white font-semibold tracking-widest px-8 py-4 rounded-full hover:bg-primary/10 transition-colors"
          >
            LOG IN
          </Link>
        </div>

        {/* Feature icons */}
        <div className="flex gap-6 md:gap-12 flex-wrap justify-center">
          <div className="flex items-center gap-2">
            <Droplet className="w-5 h-5 text-cyan" />
            <span className="text-lavender/80 text-sm tracking-wide">
              Water
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Footprints className="w-5 h-5 text-green-400" />
            <span className="text-lavender/80 text-sm tracking-wide">
              Steps
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-orange-400" />
            <span className="text-lavender/80 text-sm tracking-wide">
              Calories
            </span>
          </div>
          <div className="flex items-center gap-2">
            <HeartPulse className="w-5 h-5 text-pink" />
            <span className="text-lavender/80 text-sm tracking-wide">
              Cravings
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}
