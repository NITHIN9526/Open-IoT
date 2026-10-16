package io.github.nithin9526.openiot;

import android.graphics.Bitmap;
import androidx.test.core.app.ActivityScenario;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.*;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;

@RunWith(AndroidJUnit4.class)
public class SetupScreenTest {
    @Test public void setupRequiresValidServerAndExplicitHttpConsent() throws Exception {
        try (ActivityScenario<MainActivity> scenario = ActivityScenario.launch(MainActivity.class)) {
            onView(withText("Check and connect")).check(matches(isDisplayed()));
            File file = new File(InstrumentationRegistry.getInstrumentation().getTargetContext().getExternalFilesDir(null), "android-setup.png");
            try (FileOutputStream stream = new FileOutputStream(file)) {
                Bitmap screenshot = InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
                if (screenshot == null) throw new AssertionError("Screenshot not available");
                screenshot.compress(Bitmap.CompressFormat.PNG,100,stream); screenshot.recycle();
            }
            onView(withContentDescription("Server address")).perform(replaceText("http://192.168.1.5:3000"),closeSoftKeyboard());
            onView(withText("Check and connect")).perform(click());
            onView(withText("Check the local-network option to acknowledge that HTTP sends passwords and controls without encryption.")).check(matches(isDisplayed()));
            onView(withContentDescription("Server address")).perform(replaceText("https://localhost"),closeSoftKeyboard());
            onView(withText("Check and connect")).perform(click());
            onView(withText("Use the server's network address; localhost means this phone.")).check(matches(isDisplayed()));
            onView(withContentDescription("Server address")).perform(replaceText("https://iot.example.com"),closeSoftKeyboard());
            onView(withText("Privacy & app information")).perform(scrollTo(),click());
            onView(withText("Your connection and data")).check(matches(isDisplayed()));
            onView(withText("Close")).perform(click());
        }
    }
}
