import { RouteModal } from "@/components/route-modal";
import { NewDealView } from "@/components/new-deal-view";

export const dynamic = "force-dynamic";

export default function InterceptedNewDeal() {
  return (
    <RouteModal maxWidth="max-w-3xl">
      <NewDealView />
    </RouteModal>
  );
}
