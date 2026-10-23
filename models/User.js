export const roles = ["user", "agent", "admin"];
export const publicUser = ({ id, name, email, role }) => ({
  id,
  name,
  email,
  role,
});
