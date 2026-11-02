// The player faces +Z at heading zero; heading-up maps put that direction at the top.
export function mapPoint(x,z,player,heading,extent,w,h){const a=heading-Math.PI,c=Math.cos(a),s=Math.sin(a),dx=(x-player.x)*w/extent,dz=(z-player.z)*w/extent;return {x:w/2+c*dx-s*dz,y:h/2+s*dx+c*dz}}
export function mapDestination(u,v,player,heading,extent,w,h){const a=heading-Math.PI,c=Math.cos(a),s=Math.sin(a),dx=(u-.5)*extent,dz=(v-.5)*extent*h/w;return {x:player.x+c*dx+s*dz,z:player.z-s*dx+c*dz}}
