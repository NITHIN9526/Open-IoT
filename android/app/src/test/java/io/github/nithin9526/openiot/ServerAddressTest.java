package io.github.nithin9526.openiot;
import org.junit.Test;
import static org.junit.Assert.*;
public class ServerAddressTest {
    @Test public void acceptsHttpsAndNormalizesDefaultPort() {
        assertEquals("https://iot.example.com", ServerAddress.parse(" HTTPS://iot.example.com:443/ ", false).origin);
    }
    @Test public void releaseRejectsAllCleartext() {
        rejects("http://192.168.1.5:3000", false);
        rejects("http://iot.example.com", false);
    }
    @Test public void debugAllowsOnlyPrivateNumericIpv4() {
        for (String h : new String[]{"10.0.0.1", "172.16.0.1", "172.31.255.254", "192.168.1.5"})
            assertTrue(ServerAddress.parse("http://"+h+":3000", true).localHttp);
        for (String h : new String[]{"172.15.0.1","172.32.0.1","8.8.8.8","127.0.0.1","localhost","192.168.999.1","192.168.01.1","iot.local"})
            rejects("http://"+h, true);
    }
    @Test public void rejectsCredentialsPathsQueriesAndOtherSchemes() {
        for (String u : new String[]{"https://user:secret@iot.example.com","https://iot.example.com/dashboard","https://iot.example.com?x=1","https://iot.example.com#token","file:///etc/passwd","javascript:alert(1)","https://iot.example.com:0","https://iot.example.com:99999","https://localhost"}) rejects(u,true);
    }
    @Test public void navigationKeepsExactOrigin() {
        ServerAddress s = ServerAddress.parse("https://iot.example.com",false);
        assertTrue(s.contains("https://iot.example.com:443/dashboard?tab=1"));
        for (String u : new String[]{"https://iot.example.com.evil.test","http://iot.example.com","https://iot.example.com:3000","https://user@iot.example.com","data:text/html,test","https://other.example.com"}) assertFalse(s.contains(u));
    }
    private void rejects(String s, boolean debug) {
        try { ServerAddress.parse(s,debug); fail("Should reject: "+s); } catch (IllegalArgumentException expected) { }
    }
}
