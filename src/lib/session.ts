import { cache } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";

// Deduplicate session decoding across layouts and pages within one render only.
export const getSession = cache(() => getServerSession(authOptions));
