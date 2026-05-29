import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getProfile, getFamilyMembers } from "./actions";
import ProfileForm from "./ProfileForm";

export default async function ProfilePage() {
  const supabase = await createClient();

  // Authentication check: Secure route on server-side
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch profile and family members in parallel for high-premium performance
  const [profileResult, membersResult] = await Promise.all([
    getProfile(),
    getFamilyMembers()
  ]);

  if (profileResult.error) {
    console.error(profileResult.error);
  }
  if (membersResult.error) {
    console.error(membersResult.error);
  }

  const initialProfile = profileResult.data || { family_summary: "", concerns: "" };
  const initialMembers = membersResult.data || [];

  return (
    <ProfileForm
      initialProfile={initialProfile}
      initialMembers={initialMembers}
    />
  );
}
