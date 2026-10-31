package off.iglitch.autorewarder;

import java.util.Locale;
import java.util.TimeZone;

/** setmkt shared with the PC. Colombia (or America/Bogota) is es-CO. */
public final class BingMarket {
    private static volatile String override = "";

    private BingMarket() {}

    public static void set(String market) {
        override = normalize(market);
    }

    public static String get() {
        String set = override;
        if (set != null && !set.isEmpty()) return set;
        String tz = "";
        try {
            tz = TimeZone.getDefault().getID();
        } catch (Exception ignored) {}
        Locale loc = Locale.getDefault();
        String country = loc == null ? "" : loc.getCountry();
        String tag = loc == null ? "" : loc.toLanguageTag();
        if (tz != null && tz.contains("Bogota")) return "es-CO";
        if ("CO".equalsIgnoreCase(country)
                || (tag != null && tag.toUpperCase(Locale.US).endsWith("-CO"))) {
            return "es-CO";
        }
        String norm = normalize(tag);
        return norm.isEmpty() ? "en-US" : norm;
    }

    static String normalize(String raw) {
        if (raw == null) return "";
        String s = raw.trim().replace('_', '-');
        if (s.isEmpty() || "auto".equalsIgnoreCase(s)) return "";
        String[] parts = s.split("-");
        if (parts.length == 0 || !parts[0].matches("[A-Za-z]{2,3}")) return "";
        String lang = parts[0].toLowerCase(Locale.US);
        if (parts.length == 1) return lang;
        String region = parts[1].toUpperCase(Locale.US);
        if (!region.matches("[A-Z]{2}")) return lang;
        return lang + "-" + region;
    }
}
