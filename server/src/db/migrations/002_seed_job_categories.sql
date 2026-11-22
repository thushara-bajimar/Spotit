-- =============================================================================
-- SpotIt — 002 job categories (reference data, required in every environment)
-- `icon` is a stable key that the client maps to an icon component.
-- NOTE: Kannada names should be reviewed by a native speaker before launch.
-- =============================================================================
INSERT INTO job_categories (slug, name_en, name_kn, icon, sort_order) VALUES
  ('cleaning',             'Cleaning',                       'ಸ್ವಚ್ಛತೆ',                  'sparkles',  10),
  ('housekeeping',         'Housekeeping',                   'ಗೃಹ ನಿರ್ವಹಣೆ',              'bed',       20),
  ('household',            'Household work',                 'ಮನೆಗೆಲಸ',                   'house',     30),
  ('hotel_restaurant',     'Hotel / restaurant',             'ಹೋಟೆಲ್ / ರೆಸ್ಟೋರೆಂಟ್',        'utensils',  40),
  ('gardening',            'Gardening',                      'ತೋಟಗಾರಿಕೆ',                 'sprout',    50),
  ('watchman',             'Watchman / security',            'ಕಾವಲುಗಾರ / ಭದ್ರತೆ',           'shield',    60),
  ('shop_assistant',       'Shop assistant',                 'ಅಂಗಡಿ ಸಹಾಯಕ',               'store',     70),
  ('event_helper',         'Event helper',                   'ಕಾರ್ಯಕ್ರಮ ಸಹಾಯಕ',            'party',     80),
  ('hospital_institution', 'Hospital / institution support', 'ಆಸ್ಪತ್ರೆ / ಸಂಸ್ಥೆ ಸಹಾಯ',       'hospital',  90),
  ('other',                'Other work',                     'ಇತರ ಕೆಲಸ',                  'briefcase', 100);
