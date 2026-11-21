// Curated service copy and imagery for Template 2. Unmatched custom services use member copy without a stock image.
export type Template2ServiceContent = { description: string; image?: string };
const catalog: Record<string, Template2ServiceContent> = {
  'mens cuts': {description: 'From classic cuts to modern styles, every haircut is shaped around your hair, your routine, and the look you want. Careful blending, clean lines, and a finished style bring the whole cut together.', image: 'mens-cuts.png'},
  'kids cuts': {description: 'A haircut for younger clients should feel comfortable from start to finish. Choose a familiar style or try something new, with patient attention to the details that help them leave looking and feeling great.', image: 'kids-cuts.png'},
  'beards': {description: 'A well-groomed beard can change the balance of your whole look. Shape, clean up, and define the beard to suit your face and preferred style, from a subtle refresh to a more polished finish.', image: 'beards.webp'},
  'hot towel shaves': {description: 'Take time for a close, classic shave with the comfort of warm towels. Careful preparation and detail work leave the face feeling smooth and refreshed, with a finish that looks as good as it feels.', image: 'hot-towel-shaves.webp'},
  'eyebrows': {description: 'Clean up stray hairs and bring definition to your natural brow shape. A little attention to the details can frame your face and create a neater look without making your brows feel overdone.', image: 'eyebrows.png'},
  'facial waxing': {description: 'Remove unwanted facial hair with a service focused on a clean, smooth result. It is an easy way to tidy the details around your face and keep your look feeling fresh between appointments.', image: 'facial-waxing.jpg'},
  'perms men': {description: 'Add lasting shape, movement, and texture to your hair. Whether you want soft waves, defined curls, or extra body, the look can be tailored to your hair type and the style you want to wear.', image: 'men-perms.webp'},
  'haircut': {description: 'Clean cuts. Sharp lines. Styled your way. Whether it’s a fade, taper, or classic look, we craft every cut with precision and care. Classic or modern styles serving men and women.', image: 'haircut.jpg'},
  'skin fade': {description: 'A skin fade starts close and blends gradually into the length above. The result is a sharp, clean look shaped to your head, your hair, and the style you want, with careful detail around the edges.', image: 'skin-fade.png'},
  'fade': {description: 'A fade is all about the blend. Choose the height and finish that suit you, from subtle and low to bold and high, with smooth transitions and clean edges that make the whole haircut feel complete.', image: 'fade.jpg'},
  'beard trim': {description: 'Keep the length you like while tidying the shape, removing uneven growth, and defining the edges. A focused trim helps your beard look intentional and easier to maintain day to day.', image: 'beard-trim.jpg'},
  'haircut and beard': {description: 'Bring your haircut and beard together in one appointment. The cut, beard shape, and finishing details are planned as one look, so everything feels balanced and ready when you leave the chair.', image: 'haircut-beard.jpg'},
  'balayage': {description: 'Soft, hand-painted color adds dimension where the light naturally hits your hair. The placement can be tailored for a subtle change or a brighter look that grows out with a softer transition.', image: 'balayage.jpg'},
  'color': {description: 'Refresh your shade, cover gray, or make a bigger change with color chosen for your hair and your goals. The finished look is designed to feel balanced, flattering, and true to your personal style.', image: 'color.png'},
  'highlights': {description: 'Add brightness and dimension with highlights placed to complement your cut and natural color. Choose a soft, blended result or a more noticeable contrast that brings movement to your hair.', image: 'highlights.png'},
  'haircuts and trims': {description: 'Whether you are changing your shape or simply maintaining it, a thoughtful cut works with your hair texture and daily routine. Clean ends and careful styling help your hair feel fresh again.', image: 'haircuts-and-trims.png'},
  'perms women': {description: 'Add lasting shape, movement, and texture to your hair. Whether you want soft waves, defined curls, or extra body, the look can be tailored to your hair type and the style you want to wear.', image: 'women-perms.webp'},
  'brazilian blowout': {description: 'Smooth frizz and bring out shine while keeping the look and movement you love. This treatment is designed to make everyday styling easier and leave hair feeling softer and more manageable.', image: 'brazilian-blowout-clean.png'},
  'keratin treatment': {description: 'Give your hair a smoother feel and a polished finish with a treatment focused on reducing frizz. It can help make styling more manageable while keeping your hair looking soft and healthy.', image: 'keratin-treatment.png'},
  'hair extensions': {description: 'Add length, fullness, or both with extensions selected to blend with your own hair. The placement and finish should support the style you want while keeping the overall look natural.', image: 'hair-extensions.png'},
  'halos': {description: 'Enjoy added length and volume with a removable halo that sits beneath your own hair. Choose a color and style that blend naturally, then take it off when you are ready for your usual look.', image: 'halos.webp'},
  'womens toppers': {description: 'Add natural-looking coverage and volume to thinning hair. A topper can blend with your own hair for a fuller look tailored to your color, texture, and the style that feels like you.', image: 'womens-toppers-clean.png'},
  'hair system consultation': {description: 'Talk through your hair goals, preferred style, coverage, and questions before choosing a system. This conversation helps you understand the options, upkeep, and next steps that fit your life.', image: 'hair-system-consultation.png'},
  'hair system install': {description: 'A hair system is fitted, blended, cut, and styled to work with your features and the look you want. Attention to the hairline and finishing details helps create a natural, confident result.', image: 'hair-system-install.webp'},
  'hair system maintenance': {description: 'Keep your system looking and feeling its best with regular care. Maintenance can include cleaning, refreshing the fit, and checking the details that help your style stay comfortable and natural.'},
  'hair system retouch': {description: 'Refresh the look of an existing hair system between larger appointments. Careful attention to the fit, hairline, and styling details helps it feel secure and look like your own hair.'},
};

export function template2ServiceContent(name: string, role?: string): Template2ServiceContent | undefined {
  const key = name.toLowerCase().replace(/[’']/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (key === 'perms') return catalog[role === 'stylist' || role === 'salon' ? 'perms women' : 'perms men'];
  return catalog[key];
}
