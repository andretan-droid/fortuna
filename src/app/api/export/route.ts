import { NextResponse } from "next/server";
import { requireUserId } from "@/server/auth-helpers";
import { getExportBundle } from "@/server/queries/export";
import { buildExportWorkbook } from "@/lib/export-xlsx";
import { todayISO } from "@/lib/dates";

/** GET /api/export — streams every row the signed-in user owns as one .xlsx
 *  workbook (v5-format sheet names, so it's re-importable via the import
 *  wizard). No params: nothing beyond the auth gate is user-controlled. */
export async function GET() {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const bundle = await getExportBundle(userId);
  const buffer = buildExportWorkbook(bundle);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="fortuna-export-${todayISO()}.xlsx"`,
    },
  });
}
