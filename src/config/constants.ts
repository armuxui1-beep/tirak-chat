/* =========================================================================
   Tirak Chat — Enterprise Commercial Constants & System Configurations
   ========================================================================= */

/**
 * Primary authenticated user identifier token within local state synchronization.
 */
export const ME_ID = 'me';

/**
 * Curated, harmonious visual color palettes and gradients for user avatars,
 * story themes, and enterprise design elements across the application.
 */
export const GRADIENTS: Record<string, string> = {
  coral: 'linear-gradient(135deg, #FF686B 0%, #FF9E6B 100%)',
  navy: 'linear-gradient(135deg, #3B5BA9 0%, #1A2648 100%)',
  violet: 'linear-gradient(135deg, #8B5CF6 0%, #5B21B6 100%)',
  emerald: 'linear-gradient(135deg, #34D399 0%, #047857 100%)',
  amber: 'linear-gradient(135deg, #FBBF24 0%, #D97706 100%)',
  sky: 'linear-gradient(135deg, #38BDF8 0%, #0369A1 100%)',
  rose: 'linear-gradient(135deg, #FB7185 0%, #BE123C 100%)',
  teal: 'linear-gradient(135deg, #2DD4BF 0%, #0F766E 100%)',
  sunset: 'linear-gradient(135deg, #FF686B 0%, #8B5CF6 100%)',
  ocean: 'linear-gradient(135deg, #38BDF8 0%, #1A2648 100%)',
};

/**
 * Core commercial platform metadata and configuration specifications.
 */
export const SYSTEM_CONFIG = {
  appName: 'Tirak Chat',
  version: '2.0.0-PROD',
  environment: 'Commercial Production',
  securityStandard: 'Secure Messaging Platform',
  supportEmail: 'support@tirak.design',
};
