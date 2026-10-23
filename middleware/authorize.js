export const authorize =
  (...roles) =>
  (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ error: "Sign in to continue." });
    if (!roles.includes(req.user.role))
      return res
        .status(403)
        .json({ error: "Your role does not permit this action." });
    next();
  };
