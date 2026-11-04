# Authored human anatomy

MakeHuman hm08 base mesh, explicitly released as CC0 in September 2020.
Source: https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj
License: https://creativecommons.org/publicdomain/zero/1.0/ — see human-CC0.txt.
Original credits: Data Collection AB, Joel Palmius, Jonas Hauquier, MakeHuman Community.
Eldervale adaptation: complete body conversion, official CC0 skin-weight reduction, rest-pose adaptation, clothing material partitions, relaxed hand grip, hairstyle surfaces and armor/equipment integration. The whole body geometry is from the authored base mesh.

The adult male phenotype uses the authored `caucasian-male-young.target` and `universal-male-young-averagemuscle-averageweight.target`, with official `default_weights.mhw` and `default.mhskel`. These graphical/rigging assets are explicitly CC0. The neutral base is not used as the finished character. Original morph author: Manuel Bastioni; copyright transferred to the MakeHuman Community in 2016.
Rebuild: `python3 scripts/build-male-human.py --source <downloaded-source-directory>` (requires NumPy and SciPy).

Anatomy52 restores neutral authored hand and forearm rest coordinates from the same CC0 source. The old permanently curled palm transform is removed. Fingers receive a separate local grip morph for held equipment; scalp and hands follow their corresponding bones directly, while the body/limbs remain skinned. Existing male body proportions, saved appearance choices, armor and weapon geometry are retained.
