"use server";
import { createClient } from "@/utils/supabase/server";

export async function elevateUserToAdmin(email: string) {
  const supabase = await createClient();
  
  const userList = await supabase.auth.admin.listUsers();
  const user = userList.data.users.find((user) => user.email === email);

  if (!user) {
    throw new Error("User not found");
  }

  const { error } = await supabase.auth.admin.updateUserById(user.id, {
    user_metadata: {
      ...user.user_metadata,
      role: "Admin"
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  return;
}

export async function getAllEmails(): Promise<string[]> {
  const supabase = await createClient();
  const emails: string[] = [];
  let page = 1;
  const perPage = 50;

  while (true) {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error("Error fetching users:", error);
      break;
    }
    if (!users || users.length === 0) break;
    emails.push(...users.map(u => u.email!).filter(Boolean));
    if (users.length < perPage) break;
    page++;
  }

  return emails;
}