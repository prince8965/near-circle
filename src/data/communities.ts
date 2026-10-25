import type { Community } from '../types'

/** DEMO CONTENT. Communities across Mumbai & Navi Mumbai. */
export const SEED_COMMUNITIES: Community[] = [
  { id: 'com-ml-circle', name: 'Demo ML Circle', description: 'Study groups, workshops and talks for people learning machine learning and AI.', category: 'AI/ML', memberCount: 1280, localityId: 'powai', accent: '#A855F7', isDemo: true },
  { id: 'com-react', name: 'Demo React Collective', description: 'Monthly meetups, labs and code reviews for frontend developers.', category: 'Web Development', memberCount: 940, localityId: 'bandra', accent: '#00F2FE', isDemo: true },
  { id: 'com-campus-tech', name: 'Demo Campus Tech Club', description: 'Hackathons, coding contests and project showcases run by students.', category: 'Technology', memberCount: 2150, localityId: 'andheri', accent: '#38BDF8', isDemo: true },
  { id: 'com-design', name: 'Demo Design Guild', description: 'Design sprints, portfolio reviews and critique nights for aspiring designers.', category: 'Workshops', memberCount: 610, localityId: 'lower-parel', accent: '#C084FC', isDemo: true },
  { id: 'com-startup', name: 'Demo Startup Circle', description: 'Founder meetups, pitch practice and mentor office hours for early-stage builders.', category: 'Business', memberCount: 730, localityId: 'bkc', accent: '#818CF8', isDemo: true },
  { id: 'com-music', name: 'Demo Acoustic Collective', description: 'Open mics, jam sessions and campus gigs for student musicians.', category: 'Music', memberCount: 1560, localityId: 'vashi', accent: '#EC4899', isDemo: true },
  { id: 'com-sports', name: 'Demo Run Club', description: 'Weekend runs, five-a-side games and community fitness challenges.', category: 'Sports', memberCount: 1890, localityId: 'churchgate', accent: '#06B6D4', isDemo: true },
  { id: 'com-art', name: 'Demo Art Collective', description: 'Pop-up shows, photo walks and sketch meetups for creators of all levels.', category: 'Art', memberCount: 820, localityId: 'dadar', accent: '#F43F5E', isDemo: true },
]
