import { RouteModal } from "@/components/route-modal";
import { NewDealView } from "@/components/new-deal-view";

export default function InterceptedNewDeal() {
  return (
    <RouteModal maxWidth="max-w-lg">
      <NewDealView />
    </RouteModal>
  );
}
