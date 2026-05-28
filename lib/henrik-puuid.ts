import { henrik } from "@/lib/henrik";
import { account } from "@/lib/config";
export async function henrikPuuid(): Promise<string> {
  const acc = await henrik.account(account.name, account.tag);
  return acc.data.puuid;
}
