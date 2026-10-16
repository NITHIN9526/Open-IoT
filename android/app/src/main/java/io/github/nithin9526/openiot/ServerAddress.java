package io.github.nithin9526.openiot;

import java.net.URI;
import java.util.Locale;

/** Pure Java policy shared by setup, navigation and resource loading. */
public final class ServerAddress {
    public final String origin;
    public final boolean localHttp;
    private ServerAddress(String origin, boolean localHttp) { this.origin = origin; this.localHttp = localHttp; }
    public static ServerAddress parse(String input, boolean allowLocalHttp) {
        try {
            URI u = new URI(input.trim());
            String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
            String host = u.getHost();
            if (host == null || u.getRawUserInfo() != null || u.getRawQuery() != null || u.getRawFragment() != null ||
                !(u.getRawPath().isEmpty() || u.getRawPath().equals("/")) ||
                u.getPort() == 0 || u.getPort() > 65535 || u.getPort() < -1) throw new IllegalArgumentException();
            host = host.toLowerCase(Locale.ROOT);
            if (host.equals("localhost") || host.startsWith("127.") || host.equals("[::1]"))
                throw new IllegalArgumentException("Use the server's network address; localhost means this phone.");
            boolean http = scheme.equals("http");
            if (!scheme.equals("https") && !(http && allowLocalHttp && privateIpv4(host)))
                throw new IllegalArgumentException(allowLocalHttp ? "Use HTTPS, or a private IPv4 address for LAN testing." : "This release requires an HTTPS server address.");
            int port = u.getPort();
            String normalized = scheme + "://" + host + ((port == -1 || port == (http ? 80 : 443)) ? "" : ":" + port);
            return new ServerAddress(normalized, http);
        } catch (IllegalArgumentException e) {
            if (e.getMessage() != null) throw e;
            throw new IllegalArgumentException("Enter a server address such as https://iot.example.com, without a path or password.");
        } catch (Exception e) {
            throw new IllegalArgumentException("Enter a valid http:// or https:// server address.");
        }
    }
    static boolean privateIpv4(String host) {
        String[] parts = host.split("\\.", -1);
        if (parts.length != 4) return false;
        int[] n = new int[4];
        for (int i = 0; i < 4; i++) {
            if (!parts[i].matches("0|[1-9][0-9]{0,2}")) return false;
            n[i] = Integer.parseInt(parts[i]); if (n[i] > 255) return false;
        }
        return n[0] == 10 || (n[0] == 172 && n[1] >= 16 && n[1] <= 31) || (n[0] == 192 && n[1] == 168);
    }
    public boolean contains(String url) {
        try {
            URI u = new URI(url), base = new URI(origin);
            int port = u.getPort() == -1 ? ("https".equalsIgnoreCase(u.getScheme()) ? 443 : 80) : u.getPort();
            int basePort = base.getPort() == -1 ? (localHttp ? 80 : 443) : base.getPort();
            return u.getRawUserInfo() == null && base.getScheme().equalsIgnoreCase(u.getScheme()) &&
                base.getHost().equalsIgnoreCase(u.getHost()) && port == basePort;
        } catch (Exception e) { return false; }
    }
}
