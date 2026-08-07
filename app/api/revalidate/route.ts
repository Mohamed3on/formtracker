import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

// wc-* tags are gone: the World Cup pages read frozen data/wc/*.json snapshots.
const ALL_TAGS = ["form-analysis", "manager", "team-form", "injured"];

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const path = typeof body?.path === "string" && body.path.startsWith("/") ? body.path : null;
    const tags: string[] = Array.isArray(body?.tags) && body.tags.length > 0 ? body.tags : ALL_TAGS;

    for (const tag of tags) {
      revalidateTag(tag);
    }
    if (path) {
      revalidatePath(path);
    }

    return NextResponse.json({
      success: true,
      revalidated: tags,
      path,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error revalidating cache:", error);
    return NextResponse.json({ success: false, error: "Failed to revalidate" }, { status: 500 });
  }
}
