const functions = require("firebase-functions");

let adminInstance = null;
let corsInstance = null;

exports.sendNotification = functions.https.onRequest((req, res) => {
  if (!corsInstance) {
    corsInstance = require("cors")({ origin: true });
  }

  return corsInstance(req, res, async () => {
    if (req.method !== "POST") {
      return res.status(405).send("Method Not Allowed");
    }

    const { type, senderEmail, senderName, receiverEmail, content, title } = req.body;

    if (!senderEmail || !content) {
      return res.status(400).send("Missing senderEmail or content");
    }

    const displayName = senderName || senderEmail.split("@")[0];

    try {
      if (!adminInstance) {
        adminInstance = require("firebase-admin");
        adminInstance.initializeApp();
      }
      const db = adminInstance.firestore();
      const tokensSnapshot = await db.collection("fcm_tokens").get();
      
      const lowerSender = (senderEmail || "").toLowerCase().trim();
      const lowerReceiver = (receiverEmail || "").toLowerCase().trim();

      const registrationTokens = [];
      tokensSnapshot.forEach((doc) => {
        const email = doc.id.toLowerCase().trim();
        const data = doc.data();
        
        // Gửi cho người kia (khác email người gửi)
        if (email !== lowerSender) {
          if (lowerReceiver === "global" || lowerReceiver === email) {
            if (data.token) {
              registrationTokens.push(data.token);
            }
          }
        }
      });

      if (registrationTokens.length === 0) {
        console.log("No recipient tokens found.");
        return res.status(200).send({ success: true, message: "No tokens found" });
      }

      let notificationTitle = "";
      let notificationBody = content;

      if (type === "chat") {
        notificationTitle = displayName;
        notificationBody = content;
      } else if (type === "locket") {
        notificationTitle = displayName;
        notificationBody = content.startsWith("📷") ? content : `📷 ${content}`;
      } else {
        notificationTitle = title || displayName;
        notificationBody = content;
      }

      const payload = {
        notification: {
          title: notificationTitle,
          body: notificationBody,
        },
        webpush: {
          notification: {
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            vibrate: [100, 50, 100],
          },
          fcmOptions: {
            link: "/",
          },
        },
      };

      const response = await adminInstance.messaging().sendEachForMulticast({
        tokens: registrationTokens,
        ...payload
      });

      console.log(`Successfully sent ${response.successCount} push notifications.`);
      return res.status(200).send({ success: true, sentCount: response.successCount });
    } catch (error) {
      console.error("Error sending push notification:", error);
      return res.status(500).send({ error: error.message });
    }
  });
});
