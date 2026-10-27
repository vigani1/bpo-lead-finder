import "server-only";
import { QueryClient } from "@tanstack/react-query";
import { cache } from "react";

/** One QueryClient per server request, used to prefetch data that the page hands to the browser. */
export const getServerQueryClient = cache(() => new QueryClient());
