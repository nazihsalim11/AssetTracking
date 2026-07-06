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
   * Authenticates user against demo credentials.
   * Resolves with user session info or rejects with validation error.
   */
  login: (username, password, rememberMe) => {
    return new Promise((resolve, reject) => {
      // Simulate network latency (600ms)
      setTimeout(() => {
        if (!username || !password) {
          reject(new Error("Please enter both username and password."));
          return;
        }

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
          resolve(session);
        } else {
          reject(new Error("Invalid username or password."));
        }
      }, 600);
    });
  },

  /**
   * Restores active session from localStorage or sessionStorage.
   */
  getCurrentSession: () => {
    const local = localStorage.getItem('user_session');
    if (local) {
      try {
        return JSON.parse(local);
      } catch (e) {
        localStorage.removeItem('user_session');
      }
    }
    const session = sessionStorage.getItem('user_session');
    if (session) {
      try {
        return JSON.parse(session);
      } catch (e) {
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
    sessionStorage.removeItem('user_session');
  }
};
