# Locomotion reference and implementation

References reviewed:
- RuneLite's public Actor API distinguishes walking, running, and turning animations: https://github.com/runelite/runelite/blob/master/runelite-api/src/main/java/net/runelite/api/Actor.java
- Unity's humanoid root-motion documentation describes the relationship between body motion, foot IK, and displacement, including foot-based vertical alignment: https://docs.unity3d.com/2022.3/Documentation/Manual/RootMotion.html

Eldervale uses original procedural poses, not copied RuneScape animation assets. Walk and run have separate speed/stride profiles. Distance advances the cycle. During contact the foot moves backward relative to the body; during recovery it follows an eased forward arc. Two-bone leg solving and ankle counter-rotation keep feet level. Visual pelvis compression maintains the standing foot height without changing physics roots or saved positions. Equipped one-handed weapons retain their grip; greatswords carry at the right shoulder and switch to a two-handed grip for attacks.
