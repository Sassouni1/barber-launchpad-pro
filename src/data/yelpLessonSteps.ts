export type YelpStepSection =
  | 'Account setup'
  | 'Business info'
  | 'Verification'
  | 'Services'
  | 'Photos'
  | 'App/account finishing steps';

export interface YelpStep {
  number: number;
  title: string;
  annotatedTimestamp: string;
  sourceTimestamp: string;
  transcript: string;
  image: string;
  section: YelpStepSection;
}

const asset = (file: string) => `/lesson-assets/yelp/${file}`;

export const YELP_VIDEO_SRC = asset('Yelp Account Setup - click annotated.mp4');

export const YELP_SECTIONS: YelpStepSection[] = [
  'Account setup',
  'Business info',
  'Verification',
  'Services',
  'Photos',
  'App/account finishing steps',
];

export const YELP_STEPS: YelpStep[] = [
  {
    number: 1,
    title: 'Create or sign into Yelp',
    annotatedTimestamp: '00:11.02',
    sourceTimestamp: '00:10.52',
    transcript: 'Open Yelp, sign up or log in with Google, then complete any human verification Yelp asks for.',
    image: asset('step-01-sign-up.jpg'),
    section: 'Account setup',
  },
  {
    number: 2,
    title: 'Go to Yelp for Business',
    annotatedTimestamp: '02:02.78',
    sourceTimestamp: '01:56.28',
    transcript: 'After login, click Yelp for Business and choose the option to add a business.',
    image: asset('step-07-yelp-for-business.jpg'),
    section: 'Business info',
  },
  {
    number: 3,
    title: 'Enter contact info',
    annotatedTimestamp: '02:32.88',
    sourceTimestamp: '02:23.38',
    transcript: 'Enter your business email and the phone number where clients should contact you.',
    image: asset('step-10-continue-email.jpg'),
    section: 'Business info',
  },
  {
    number: 4,
    title: 'Add website',
    annotatedTimestamp: '02:54.34',
    sourceTimestamp: '02:42.84',
    transcript: 'Add your real website or booking link, then continue to the category setup.',
    image: asset('step-12-continue-website.jpg'),
    section: 'Business info',
  },
  {
    number: 5,
    title: 'Choose hair loss categories',
    annotatedTimestamp: '03:20.94',
    sourceTimestamp: '03:08.44',
    transcript: 'Search for hair loss and choose Hair Loss Centers so the page can rank for the right clients.',
    image: asset('step-13-hair-loss-centers.jpg'),
    section: 'Business info',
  },
  {
    number: 6,
    title: 'Add address and location count',
    annotatedTimestamp: '04:36.52',
    sourceTimestamp: '04:22.02',
    transcript: 'Enter your business address and select the location count that fits your shop.',
    image: asset('step-15-continue-locations.jpg'),
    section: 'Business info',
  },
  {
    number: 7,
    title: 'Verify by text',
    annotatedTimestamp: '05:14.48',
    sourceTimestamp: '04:58.98',
    transcript: 'Choose text verification when available, send the code, and finish Yelp verification.',
    image: asset('step-16-send-verification.jpg'),
    section: 'Verification',
  },
  {
    number: 8,
    title: 'Skip the ad offer',
    annotatedTimestamp: '05:42.58',
    sourceTimestamp: '05:26.08',
    transcript: 'Decline Yelp ad offers during setup unless you intentionally want to pay for ads.',
    image: asset('step-17-decline-offer.jpg'),
    section: 'Verification',
  },
  {
    number: 9,
    title: 'Add the right services',
    annotatedTimestamp: '07:04.06',
    sourceTimestamp: '06:46.56',
    transcript: 'Add the hair loss, barber, stylist, SMP, haircut, and related services you actually offer.',
    image: asset('step-18-add-hair-loss-services.jpg'),
    section: 'Services',
  },
  {
    number: 10,
    title: 'Save services and description',
    annotatedTimestamp: '08:59.68',
    sourceTimestamp: '08:34.18',
    transcript: 'Save the services, write a clean description, then continue to photos.',
    image: asset('step-26-save-and-continue.jpg'),
    section: 'Services',
  },
  {
    number: 11,
    title: 'Download and upload photos',
    annotatedTimestamp: '10:09.16',
    sourceTimestamp: '09:41.66',
    transcript: 'Use the membership hub hair system content, save the best images, rename them clearly, and upload them to Yelp.',
    image: asset('step-28-hair-system-content.jpg'),
    section: 'Photos',
  },
  {
    number: 12,
    title: 'Finish setup in the app',
    annotatedTimestamp: '12:41.26',
    sourceTimestamp: '12:07.76',
    transcript: 'Save photos, download or open the Yelp app if prompted, confirm email, add missing details, and finish the page setup.',
    image: asset('step-34-save-photos.jpg'),
    section: 'App/account finishing steps',
  },
];
