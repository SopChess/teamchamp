/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Επιτρέπει ανέβασμα βεβαίωσης φοίτησης (PDF/εικόνα) μέσω server action.
    // Το προεπιλεγμένο όριο (1MB) είναι πολύ μικρό για σαρωμένα έγγραφα.
    serverActions: { bodySizeLimit: "8mb" },
  },
};

module.exports = nextConfig;
