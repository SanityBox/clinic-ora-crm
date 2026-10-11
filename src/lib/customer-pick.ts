/**
 * The new-customer tab tells the form that opened it which customer to select (stage 37).
 * A token per request, so with several forms open only the one that asked picks her.
 */
export const PICK_CHANNEL = "ora-customer-picked";

export type PickedCustomer = { id: string; full_name: string; phone: string };
export type PickMessage = { token: string; customer: PickedCustomer };

export function sendPick(message: PickMessage) {
  const channel = new BroadcastChannel(PICK_CHANNEL);
  channel.postMessage(message);
  channel.close();
}
