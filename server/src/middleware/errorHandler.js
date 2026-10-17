export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

export const notFound = (req, res) =>
  res.status(404).json({ message: `Route not found: ${req.originalUrl}` });

export const errorHandler = (err, req, res, next) => {
  console.error(err);
  if (err.code === 11000) return res.status(409).json({ message: "Duplicate value" });
  if (err.name === "CastError") return res.status(400).json({ message: "Invalid id" });
  res.status(err.status || 500).json({ message: err.status ? err.message : "Server error" });
};