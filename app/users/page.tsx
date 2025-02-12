import { Separator } from "@/components/ui/separator";
import { TypographyH2 } from "@/components/ui/typography";
import { createServerSupabaseClient } from "@/lib/server-utils";
import { redirect } from "next/navigation";

export default async function UsersPage() {
  const supabase = createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) {
    // this is a protected route - only users who are signed in can view this route
    redirect("/");
  }

  // Fetch all users from the profiles table
  const { data: users, error } = await supabase.from("profiles").select("id, display_name, email, biography");

  if (error) {
    console.error("Error fetching users:", error);
    return <p>Error loading users.</p>;
  }

  return (
    <div className="container mx-auto p-6">
      {/* Page Title */}
      <TypographyH2>Users List</TypographyH2>
      <Separator className="my-4" />
      {/* Grid of Users */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {users.map((user) => (
          <div key={user.id} className="rounded-lg border p-4 shadow-md">
            <h2 className="text-xl font-semibold">{user.display_name}</h2>
            <p className="text-sm text-gray-600">{user.email}</p>
            <p className="mt-2">{user.biography ?? "No biography provided."}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
