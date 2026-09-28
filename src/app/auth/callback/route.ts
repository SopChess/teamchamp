import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Παλιό magic-link callback — δεν χρησιμοποιείται πια (η πρόσβαση γίνεται με
 * μόνιμα προσωπικά links, /access/<token>). Μένει μόνο ως ασφαλής ανακατεύθυνση
 * για παλιά emails που ίσως υπάρχουν ακόμα στα εισερχόμενα.
 */
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/login`);
}
