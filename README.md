# p2p-expert (Mobile-First Registration & Main Login Portals)

Yeh project do alag-alag websites / portals ke liye tayar kiya gaya hai:

1. **Registration Website (Subdomain ke liye)**:
   - **Local URL**: `http://localhost:3001`
   - **Production Subdomain**: `https://register.p2p-expert.com`
   - **Folder**: `registration-site/`
   - **Features**:
     - Mobile-first clean UI (Trader’s account registration).
     - Gmail aur Password daalne par backend se 6-digit OTP generate hota hai.
     - Gmail SMTP (`nodemailer`) se direct user ke Gmail par OTP send hota hai.
     - Modern 6-digit OTP verification box with auto-focus, paste support, aur 60-second resend timer.
     - OTP verify hone ke baad **"Registration Successful!"** welcome page open hota hai.
     - **Copy Link button**: Main portal ka link clipboard me copy karta hai toast alert ke sath.
     - **Next button**: User ko direct main login website par le jata hai.
     - Note: Registration page se "Already registered? Sign in" wala option completely hata diya gaya hai taaki dono portals bilkul alag rahein.

2. **Main Login Website (Main Domain ke liye)**:
   - **Local URL**: `http://localhost:3000`
   - **Production Domain**: `https://p2p-expert.com`
   - **Folder**: `main-site/`
   - **Features**:
     - Aapki screenshot se 100% matched design:
       - Minimalist `->]` sign-in icon
       - Bold title: **Trader’s account login**
       - Rounded pill inputs: **Email** aur **Password** (eye toggle show/hide ke sath)
       - Slate-grey pill button: **Sign in**
       - **Can’t log in?** support link
     - Registration ke time dale hue Gmail & Password se authenticate hota hai.
     - Login button dabane par **2-second ka smooth welcome animation** chalta hai.
     - Uske baad **Trader Welcome Dashboard** open hota hai (Trader ID, verified badge, wallet balance, next features ready).

---

## ⚙️ Gmail SMTP Setup (.env)

Apne Gmail se real OTP bhejne ke liye [.env](file:///Users/apple/Desktop/p2p%20web/.env) file me ye details dalein:

```env
PORT_MAIN=3000
PORT_REGISTER=3001

MAIN_SITE_URL=http://localhost:3000
REGISTER_SITE_URL=http://localhost:3001

APP_NAME=p2p-expert

# Apka Gmail aur Google App Password:
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=apka-email@gmail.com
SMTP_PASS=apka-16-akshar-ka-app-password
```

### Google App Password kaise banaye:
1. Apne Google Account me jayein (`myaccount.google.com`) -> **Security**.
2. **2-Step Verification** ON karein.
3. Search bar me type karein **App passwords**.
4. App name me `p2p-expert` dalein aur **Create** par click karein.
5. Jo 16-akshar ka password milega, use `.env` me `SMTP_PASS` me daal dein.

*(Jab tak aap SMTP details nahi daalte, tab tak system auto-test mode me chalega aur screen par OTP show karega taaki aap bina wait kiye testing kar sakein!)*

---

## 🚀 Run Kaise Karein

```bash
# Start server (Dono portals ek sath start honge)
npm start
```

- **Main Login Portal**: [http://localhost:3000](http://localhost:3000)
- **Registration Subdomain Portal**: [http://localhost:3001](http://localhost:3001)

---

## 📂 Project Structure

```
p2p web/
├── backend/
│   ├── server.js          # Express backend API & static server
│   ├── db.js              # Persistent database for users & OTPs
│   └── mailer.js          # Nodemailer Gmail SMTP handler
├── registration-site/      # Subdomain Portal
│   ├── index.html         # Form -> OTP -> Success / Copy Link / Next
│   ├── config.js          # Subdomain/Domain auto-resolver
│   ├── css/style.css      # Mobile-first stylesheet
│   └── js/app.js          # OTP timer, verify & copy link logic
├── main-site/              # Main Domain Portal
│   ├── index.html         # Exact screenshot replica + 2s animation
│   ├── config.js          # Main domain config
│   ├── css/style.css      # Screenshot match CSS
│   └── js/app.js          # Sign in, 2s animation & dashboard logic
├── .env                   # Configuration & SMTP secrets
├── .env.example           # Example config template
└── package.json           # Scripts & dependencies
```
