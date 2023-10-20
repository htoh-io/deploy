# output "public_ip" {
#   value = scaleway_instance_ip.public_ip.address
# }

# output "private_ip" {
#     value = data.scaleway_vpc_public_gateway_dhcp_reservation.by_mac_address
# }

# output "pool" {
#     value = regex(".*/(.+)$", scaleway_k8s_pool.kosmos_external.id)
# }