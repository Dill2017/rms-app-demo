import { createFileRoute, Link } from "@tanstack/react-router";
import { BubbleBackground } from "@/components/backgrounds/bubble";
import { Building2, BookOpen, Target, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: WelcomePage,
});

function WelcomePage() {
  return (
    <BubbleBackground
      interactive
      className="min-h-[calc(100vh-3.5rem)]"
      colors={{
        first: "59,130,246",
        second: "99,102,241",
        third: "14,165,233",
        fourth: "79,70,229",
        fifth: "56,189,248",
        sixth: "129,140,248",
      }}
    >
      <div className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-6 text-center">
        <div className="space-y-8 max-w-2xl">
          <div className="flex justify-center">
            <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 shadow-2xl">
              <Building2 className="h-10 w-10 text-white" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white">
              Hotel RMS
            </h1>
            <p className="text-xl sm:text-2xl text-white/70 font-light leading-relaxed max-w-lg mx-auto">
              Optimize pricing across 800+ properties. Maximize RevPAR.
              Stay ahead of the competition.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link
              to="/guide"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-white text-slate-900 font-semibold text-lg shadow-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            >
              <BookOpen className="h-5 w-5" />
              Read the Guide
              <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>

            <Link
              to="/opportunities"
              className="group flex items-center gap-3 px-8 py-4 rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 text-white font-semibold text-lg hover:bg-white/20 transition-all hover:scale-[1.02]"
            >
              <Target className="h-5 w-5" />
              Explore Opportunities
              <ArrowRight className="h-4 w-4 opacity-50 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
            </Link>
          </div>
        </div>
      </div>
    </BubbleBackground>
  );
}
