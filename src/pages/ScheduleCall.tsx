// Calendar booking page
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Clock, Calendar, Globe } from "lucide-react";

export default function ScheduleCall() {
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-muted rounded-lg p-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            1 ON 1 CALL (THURSDAYS & FRIDAYS)
          </h1>
        </div>

        {/* Description */}
        <div className="space-y-4 text-lg text-foreground">
          <p>
            We are here to help support your goals, during these calls we can make any changes needed on your website, turn on ads, adjust branding or anything needed.
          </p>
          <p>
            All changes will take place during the call and within 24 hours after communicating.
          </p>
        </div>

        {/* Calendar Card */}
        <Card className="p-6 space-y-4">
          <h2 className="text-xl font-bold text-foreground">
            VIP Support Calls (1 on 1)
          </h2>
          
          <div className="space-y-2 text-muted-foreground">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>30 Mins</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              <span>Thu & Fri Available</span>
            </div>
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>America/New_York (EST)</span>
            </div>
          </div>

          {/* Calendar Embed */}
          <div className="mt-6 rounded-lg">
            <iframe
              src="https://api.leadconnectorhq.com/widget/booking/uCzRuWcuMfZusci2YhF5"
              style={{ width: "100%", border: "none", minHeight: "1200px" }}
              id="uCzRuWcuMfZusci2YhF5_1767813565087"
            />
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
