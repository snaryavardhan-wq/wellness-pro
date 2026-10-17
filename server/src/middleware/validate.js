export default (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({ field: i.path.join("."), message: i.message }));
    return res.status(400).json({ message: "Validation failed", errors });
  }
  req.body = result.data;
  next();
};
