// Predefined demo credentials matching the roles in the application
export const DEMO_CREDENTIALS = [
  {
    role: "Super Admin",
    username: "admin",
    password: "Admin@123",
    email: "admin@company.com",
    name: "Admin Operations"
  },
  {
    role: "IT Admin",
    username: "itadmin",
    password: "IT@123",
    email: "itadmin@company.com",
    name: "IT Operations"
  },
  {
    role: "Facility Admin",
    username: "facilityadmin",
    password: "Facility@123",
    email: "facilityadmin@company.com",
    name: "Facility Operations"
  },
  {
    role: "Finance Team",
    username: "finance",
    password: "Finance@123",
    email: "finance@company.com",
    name: "Finance Operations"
  },
  {
    role: "Employee",
    username: "employee",
    password: "Employee@123",
    email: "employee@company.com",
    name: "Alice Johnson"
  },
  {
    role: "Auditor",
    username: "auditor",
    password: "Auditor@123",
    email: "auditor@company.com",
    name: "Audit Team"
  }
];

export const mockAuthService = {
  /**
   * Authenticates user against backend API or falls back to local demo credentials.
   */
  login: async (username, password, rememberMe) => {
    if (!username || !password) {
      throw new Error("Please enter both username and password.");
    }

    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      if (response.ok) {
        const data = await response.json();
        const session = data.session;
        const storage = rememberMe ? localStorage : sessionStorage;
        storage.setItem('user_session', JSON.stringify(session));
        storage.setItem('auth_token', data.token);
        return session;
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || "Invalid username or password.");
      }
    } catch (err) {
      // Fallback if the server is offline or unreachable
      if (err.message === "Failed to fetch" || err.name === "TypeError") {
        console.warn("API Server offline, falling back to local credentials...");
        const user = DEMO_CREDENTIALS.find(
          u => u.username.toLowerCase() === username.toLowerCase() && u.password === password
        );

        if (user) {
          const session = {
            username: user.username,
            role: user.role,
            name: user.name,
            email: user.email
          };
          const storage = rememberMe ? localStorage : sessionStorage;
          storage.setItem('user_session', JSON.stringify(session));
          return session;
        } else {
          throw new Error("Invalid username or password.");
        }
      } else {
        throw err;
      }
    }
  },

  /**
   * Restores active session from localStorage or sessionStorage.
   */
  getCurrentSession: () => {
    const local = localStorage.getItem('user_session');
    if (local) {
      try {
        return JSON.parse(local);
      } catch {
        localStorage.removeItem('user_session');
      }
    }
    const session = sessionStorage.getItem('user_session');
    if (session) {
      try {
        return JSON.parse(session);
      } catch {
        sessionStorage.removeItem('user_session');
      }
    }
    return null;
  },

  /**
   * Completely terminates session from client storage.
   */
  logout: () => {
    localStorage.removeItem('user_session');
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('user_session');
    sessionStorage.removeItem('auth_token');
  }
};
