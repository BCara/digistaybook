import { useAuth } from "../auth/AuthProvider";
import { useProperty } from "../host/useProperty";
import { propertyBlock } from "../host/usePropertyDraft";
import { PropertyShell } from "../host/PropertyShell";
import { GuestReviewPanel } from "../host/GuestReviewPanel";
import type { HostProperty } from "../host/propertyStore";

export function HostFeedbackPage({ propertyId }: { propertyId: string }) {
  const { user } = useAuth();
  const [load] = useProperty(propertyId);
  const block = propertyBlock(load, user?.uid);
  if (block) return <main className="page"><h1>{block.title}</h1><p>{block.message}</p><a href="/host">Back to properties</a></main>;
  const property = (load as { status: "ready"; property: HostProperty }).property;
  return <PropertyShell property={property} current="feedback"><GuestReviewPanel key={propertyId} propertyId={propertyId} feedbackOnly /></PropertyShell>;
}
