import { NextRequest, NextResponse } from "next/server";
import { failure, success } from "@/lib/api/response";
import { createSupabaseAdminClient, requireAuthUser } from "@/lib/supabase/route-client";

export async function DELETE(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.ok) {
    return NextResponse.json(failure("UNAUTHORIZED", auth.message), { status: 401 });
  }

  try {
    // Supabaseのadmin APIを使用してユーザーを削除
    const adminClient = createSupabaseAdminClient();
    const { error } = await adminClient.auth.admin.deleteUser(auth.user.id);

    if (error) {
      return NextResponse.json(failure("ACCOUNT_DELETE_FAILED", error.message), { status: 400 });
    }

    return NextResponse.json(success({ deleted: true }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(failure("ACCOUNT_DELETE_FAILED", message), { status: 500 });
  }
}
