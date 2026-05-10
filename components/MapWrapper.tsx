"use client";

import dynamic from "next/dynamic";

const DeliveryMap = dynamic(() => import("./DeliveryMap"), {
  ssr: false,
});

export default function MapWrapper({ deliveryId }: { deliveryId: string }) {
  return <DeliveryMap deliveryId={deliveryId} />;
}