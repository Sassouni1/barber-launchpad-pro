import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AppointmentSettingPractice } from "@/components/lesson/AppointmentSettingPractice";
import { APPOINTMENT_SETTING_MODULE_ID } from "@/data/appointmentSettingPractice";

export default function AppointmentSettingPracticePage() {
  return (
    <DashboardLayout>
      <main className="mx-auto max-w-6xl space-y-6 pb-12">
        <Link to={`/courses/business/lesson/${APPOINTMENT_SETTING_MODULE_ID}`} className="inline-flex items-center gap-2 rounded-lg px-1 py-2 text-sm font-medium text-[#d6d0c6] transition hover:text-[#edc465]">
          <ArrowLeft className="h-4 w-4" /> Back to Appointment Setting
        </Link>
        <div className="border-b border-[#d4a944]/35 pb-5">
          <h1 className="font-display text-3xl font-bold text-[#f8f2e9] sm:text-4xl">Practicing Appointment Settings</h1>
        </div>
        <AppointmentSettingPractice />
      </main>
    </DashboardLayout>
  );
}
