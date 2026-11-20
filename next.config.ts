import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
export default function config(phase: string): NextConfig {
  return {
    serverExternalPackages: ['better-sqlite3'],
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next' : '.next-production',
  };
}
