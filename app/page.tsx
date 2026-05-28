import Splash from "./Splash";
import { getAccountMmr } from "@/lib/db/queries";
export default async function Page() {
  const data = await getAccountMmr();
  const a = data?.account ?? {
    name: "ST1CCS",
    tag: "STONE",
    account_level: 0,
    region: "na",
  };
  return (
    <Splash
      name={a.name}
      tag={a.tag}
      level={a.account_level}
      region={a.region}
    />
  );
}
