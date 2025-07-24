/**
 * UI Constants for Lords of Doomspire
 * Visual constants and utility functions used across components
 */

// Tier-based background colors
export const TIER_COLORS = {
    1: "#E8F5E8", // Light green
    2: "#FFF3CD", // Light yellow  
    3: "#F8D7DA", // Light red
    default: "white",
} as const;

// Tier-based solid colors (for badges, etc.)
export const TIER_SOLID_COLORS = {
    1: "#4CAF50", // Green
    2: "#FF9800", // Orange
    3: "#F44336", // Red
} as const;

/**
 * Get the background color for a given tier
 */
export const getTierBackgroundColor = (tier: number | undefined): string => {
    if (!tier || !(tier in TIER_COLORS)) {
        return TIER_COLORS.default;
    }
    return TIER_COLORS[tier as keyof typeof TIER_COLORS];
};

/**
 * Get the solid color for a given tier (for badges, indicators, etc.)
 */
export const getTierSolidColor = (tier: number | undefined): string => {
    if (!tier || !(tier in TIER_SOLID_COLORS)) {
        return "#666666"; // Gray default
    }
    return TIER_SOLID_COLORS[tier as keyof typeof TIER_SOLID_COLORS];
};

/**
 * Get tier display text (Roman numerals)
 */
export const getTierDisplayText = (tier: number | undefined): string => {
    switch (tier) {
        case 1:
            return "I";
        case 2:
            return "II";
        case 3:
            return "III";
        default:
            return "?";
    }
};

/**
 * Biome display names
 */
export const BIOME_DISPLAY_NAMES = {
    plains: "Plains",
    mountains: "Mountains",
    woodlands: "Woodlands",
} as const;

/**
 * Get display name for a biome
 */
export const getBiomeDisplayName = (biome: string): string => {
    return BIOME_DISPLAY_NAMES[biome as keyof typeof BIOME_DISPLAY_NAMES] || biome;
}; 